using System;
using System.Net.Http;
using Microsoft.Azure.Cosmos;

namespace NetzeBW.Netzbau.Bau.Tools.DataMigration.Providers;

/// <summary>
/// Dla lokalnego emulatora Cosmos (Docker, port 8081) walidacja TLS na Macu często pada (self-signed).
/// Ten helper wyłącza sprawdzanie certyfikatu wyłącznie gdy connection string wskazuje localhost / 127.0.0.1:8081.
/// <para><b>Użycie:</b> w <c>CosmosDbProvider</c> (lub tam gdzie tworzysz klienta) zamiast
/// <c>new CosmosClient(connectionString)</c> wołaj <see cref="Create"/>.</para>
/// <para>Nie używaj na produkcyjnym Azure — tylko dev / emulator.</para>
/// </summary>
internal static class CosmosClientFactoryForLocalEmulator
{
    public static CosmosClient Create(string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        if (!LooksLikeLocalCosmosEmulatorHttps8081(connectionString))
        {
            return new CosmosClient(connectionString);
        }

        var options = new CosmosClientOptions
        {
            ConnectionMode = ConnectionMode.Gateway,
            HttpClientFactory = () =>
            {
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback =
                        HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
                };
                return new HttpClient(handler);
            },
        };

        return new CosmosClient(connectionString, options);
    }

    private static bool LooksLikeLocalCosmosEmulatorHttps8081(string connectionString) =>
        connectionString.Contains("https://localhost:8081", StringComparison.OrdinalIgnoreCase)
        || connectionString.Contains("https://127.0.0.1:8081", StringComparison.OrdinalIgnoreCase);
}
