using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos;
using NetzeBW.Netzbau.Bau.Tools.DataMigration.Models;
using NetzeBW.Netzbau.Bau.Tools.DataMigration.Providers;

namespace NetzeBW.Netzbau.Bau.Tools.DataMigration.Migrations;

/// <summary>
/// PBI: 4790587 - HS Portal - Improvements for certain roles of Adressbook: 02/2026
/// Update some already existing Hochspannung contacts role names.
/// </summary>
internal sealed class Migration_Update_Existing_And_Add_New_HS_Contacts_Roles : IMigrationScript
{
    private const string SETTING_CONTACTS_COSMOSDB_CONNECTION_STRING = "ContactsCosmosDbConnectionString";

    public string[] Settings { get; } = new[] { SETTING_CONTACTS_COSMOSDB_CONNECTION_STRING };

    private int _foundContactsToBeUpdatedCount = 0;

    private int _contactsThatActuallyHaveBeenUpdatedCount = 0;

    private int _skippedContactsCount = 0;

    private int _maxAttemptsExceededCount = 0;

    private int _failedUpdatesCount = 0;

    private sealed record RoleNameMigration(string OldName, string NewName);

    /// <summary>
    /// Single source of truth: role Id → old and new display names. Adjust only this map for future renames.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, RoleNameMigration> RoleNameMigrations =
        new Dictionary<string, RoleNameMigration>(StringComparer.Ordinal)
        {
            {
                "d6095a3a702c48f5b48f0fea7fb719bd",
                new RoleNameMigration("Netzführung HS", "Systemführung HS")
            },
            {
                "49ee1de848574fd1a547ed7f36bea90b",
                new RoleNameMigration(
                    "Schaltungskoordination HS Netze BW (Betriebsplanung)",
                    "Maßnahmenkoordination HS Netze BW (ehem. Betriebsplanung HS)")
            },
            {
                "c2a00b9ecc2642f989d12e4669f87cd7",
                new RoleNameMigration(
                    "Schaltungskoordination MS Netze BW (Betriebsplanung)",
                    "Schaltungskoordination MS Netze BW (Backoffice)")
            },
        };

    private static string EscapeCosmosSqlStringLiteral(string value)
    {
        return value.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("\"", "\\\"", StringComparison.Ordinal);
    }

    /// <summary>
    /// Documents where at least one tracked role still has a name other than the target <see cref="RoleNameMigration.NewName"/>.
    /// </summary>
    private static string BuildDocumentsToUpdateQuery()
    {
        var parts = RoleNameMigrations.Select(kv =>
            $"role.Id = \"{kv.Key}\" and role.Name != \"{EscapeCosmosSqlStringLiteral(kv.Value.NewName)}\"");
        var whereClause = string.Join(" or ", parts);
        return
            $"select distinct assignment.id, assignment.Roles, assignment._etag from assignments as assignment join role in assignment.Roles where {whereClause}";
    }

    /// <summary>
    /// Count of distinct assignments that still carry any of the legacy <see cref="RoleNameMigration.OldName"/> values.
    /// </summary>
    private static string BuildRemainingOldNamesCountQuery()
    {
        var parts = RoleNameMigrations.Select(kv =>
            $"role.Id = \"{kv.Key}\" and role.Name = \"{EscapeCosmosSqlStringLiteral(kv.Value.OldName)}\"");
        var whereClause = string.Join(" or ", parts);
        return
            $"select value count(1) from (select distinct assignment.id from assignments as assignment join role in assignment.Roles where {whereClause})";
    }

    public async Task Run(Dictionary<string, string> settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        if (!settings.TryGetValue(SETTING_CONTACTS_COSMOSDB_CONNECTION_STRING, out var contactsCosmosDbConnectionString) ||
            string.IsNullOrWhiteSpace(contactsCosmosDbConnectionString))
        {
            throw new ArgumentException("Contacts CosmosDB connection string is required.", nameof(settings));
        }

        var container = new CosmosDbProvider(contactsCosmosDbConnectionString, database: "contacts", container: "assignments")
            .GetContainer();

        var parallelOptions = new ParallelOptions { MaxDegreeOfParallelism = 4 };
        using (var iterator = container.GetItemQueryStreamIterator(BuildDocumentsToUpdateQuery()))
        {
            var iterationCount = 1;
            while (iterator.HasMoreResults)
            {
                Console.WriteLine($"Processing documents page number {iterationCount}...");
                using (var response = await iterator.ReadNextAsync())
                {
                    response.EnsureSuccessStatusCode();

                    var resultsPage = await JsonSerializer.DeserializeAsync<JsonObject>(response.Content);
                    var pageCount = resultsPage["_count"].GetValue<int>();
                    Console.WriteLine($"Found {pageCount} documents in the page.");
                    _foundContactsToBeUpdatedCount += pageCount;
                    var contactJsonObjects = resultsPage["Documents"].AsArray().Select(node => node.AsObject());

                    await Parallel.ForEachAsync(contactJsonObjects, parallelOptions, async (contactJsonObject, cancellationToken) =>
                    {
                        await ProcessContactDocument(container, contactJsonObject);
                    });
                }

                Console.WriteLine($"Documents page number {iterationCount} has been processed.");
                iterationCount++;
            }
        }

        if (_foundContactsToBeUpdatedCount == 0)
        {
            Console.WriteLine("Found no contacts that need to be updated, skipping the migration process.");
            return;
        }

        Console.WriteLine($"Found contacts that need to be updated: {_foundContactsToBeUpdatedCount}");
        Console.WriteLine($"Contacts that actually have been updated: {_contactsThatActuallyHaveBeenUpdatedCount}");
        Console.WriteLine($"Contacts that have been skipped: {_skippedContactsCount}");
        Console.WriteLine($"Contacts that have exceeded the max retry count on ETag mismatch: {_maxAttemptsExceededCount}");
        Console.WriteLine($"Contacts that have failed to be updated: {_failedUpdatesCount}");

        var postUpdateContactsCount = await GetPostUpdateContactsCount(container);
        Console.WriteLine($"SANITY CHECK - assignments still using legacy role names: {postUpdateContactsCount}");
        if (postUpdateContactsCount == 0)
        {
            Console.WriteLine("SUCCESS - No assignments remain with legacy names for tracked roles.");
        }
        else
        {
            Console.WriteLine(
                "ERROR - Some assignments still have legacy role names; verify patches or data (unexpected Name values).");
        }
    }

    private async ValueTask ProcessContactDocument(Container container, JsonObject contactJsonObject)
    {
        ArgumentNullException.ThrowIfNull(container);
        ArgumentNullException.ThrowIfNull(contactJsonObject);

        const byte MAX_ATTEMPT_COUNT = 3;
        string id = string.Empty;
        for (var attemptCount = 1; attemptCount <= MAX_ATTEMPT_COUNT; attemptCount++)
        {
            var roleIds = contactJsonObject["Roles"].AsArray().Select(node => node.AsObject()["Id"].GetValue<string>())
                .ToArray();
            var contactHasNoRoles = roleIds.Length == 0;
            if (contactHasNoRoles)
            {
                Interlocked.Increment(ref _skippedContactsCount);
                return;
            }

            var patchOperationsToApplyOnTheDocument = new List<PatchOperation>(roleIds.Length);
            for (var currentRoleIndex = 0; currentRoleIndex < roleIds.Length; currentRoleIndex++)
            {
                var isOldRoleThatNeedsToBeUpdated =
                    RoleNameMigrations.TryGetValue(roleIds[currentRoleIndex], out var migration);

                if (!isOldRoleThatNeedsToBeUpdated)
                {
                    continue;
                }

                var newUpToDateRoleNameToBeSet = migration.NewName;
                patchOperationsToApplyOnTheDocument.Add(
                    PatchOperation.Replace($"/Roles/{currentRoleIndex}/Name", newUpToDateRoleNameToBeSet));
            }

            var noPatchOperationsToApplyOnTheDocument = patchOperationsToApplyOnTheDocument.Count == 0;
            if (noPatchOperationsToApplyOnTheDocument)
            {
                Interlocked.Increment(ref _skippedContactsCount);
                return;
            }

            id = contactJsonObject["id"].GetValue<string>();
            var etag = contactJsonObject["_etag"].GetValue<string>();

            using var patchResponse = await container.PatchItemStreamAsync(
                id,
                PartitionKey.None,
                patchOperationsToApplyOnTheDocument,
                new ItemRequestOptions { IfMatchEtag = etag });

            if (patchResponse.IsSuccessStatusCode)
            {
                Console.WriteLine($"Successfully patched contact assignment with ID '{id}'.");
                Interlocked.Increment(ref _contactsThatActuallyHaveBeenUpdatedCount);
                return;
            }

            if (patchResponse.StatusCode == HttpStatusCode.PreconditionFailed)
            {
                Console.WriteLine($"Patching contact assignment with ID '{id}' failed on the '{attemptCount}' attempt, re-trying the update...");
                using var documentResponse = await container.ReadItemStreamAsync(id, PartitionKey.None);
                if (!documentResponse.IsSuccessStatusCode)
                {
                    return;
                }

                contactJsonObject = await JsonSerializer.DeserializeAsync<JsonObject>(documentResponse.Content);
                continue;
            }

            Interlocked.Increment(ref _failedUpdatesCount);
            Console.WriteLine(
                $"ERROR: Unexpected error while patching contact assignment with ID '{id}', code: '{(int)patchResponse.StatusCode}', message: '{patchResponse.ErrorMessage}'.");
        }

        Console.WriteLine($"ERROR: Failed to patch contact assignment with ID '{id}' after {MAX_ATTEMPT_COUNT} attempts (ETag mismatch).");
        Interlocked.Increment(ref _maxAttemptsExceededCount);
    }

    private async Task<int> GetPostUpdateContactsCount(Container container)
    {
        var postUpdateContactCount = 0;
        using (var iterator = container.GetItemQueryStreamIterator(BuildRemainingOldNamesCountQuery()))
        {
            while (iterator.HasMoreResults)
            {
                using (var response = await iterator.ReadNextAsync())
                {
                    response.EnsureSuccessStatusCode();

                    var resultsPage = await JsonSerializer.DeserializeAsync<JsonObject>(response.Content);
                    postUpdateContactCount = resultsPage["Documents"].AsArray().Single().GetValue<int>();

                    return postUpdateContactCount;
                }
            }
        }

        return postUpdateContactCount;
    }
}
