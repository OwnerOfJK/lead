"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

interface Connection {
  id: string;
  provider: string;
  status: string;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDERS = ["hubspot", "pipedrive", "zendesk"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  zendesk: "Zendesk",
};

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <ConnectionsContent />
    </Suspense>
  );
}

function ConnectionsContent() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      setToast(`${PROVIDER_LABELS[connected] || connected} connected successfully`);
      window.history.replaceState(null, "", "/connections");
    }
  }, [searchParams]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated) fetchConnections();
  }, [isAuthenticated]);

  async function fetchConnections() {
    try {
      const data = await apiFetch<Connection[]>("/connections");
      setConnections(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getConnection(provider: string) {
    return connections.find((c) => c.provider === provider);
  }

  async function handleConnect(provider: string) {
    setActionLoading(provider);
    try {
      const { url } = await apiFetch<{ url: string }>(
        `/connections/${provider}/auth`
      );
      window.open(url, "_blank");
      setActionLoading(null);
    } catch (err: any) {
      setError(err.message);
      setActionLoading(null);
    }
  }

  async function handleDisconnect(connection: Connection) {
    setActionLoading(connection.provider);
    try {
      await apiFetch<void>(`/connections/${connection.id}`, {
        method: "DELETE",
      });
      setConnections((prev) => prev.filter((c) => c.id !== connection.id));
      setToast(`${PROVIDER_LABELS[connection.provider]} disconnected`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSync(connection: Connection) {
    setActionLoading(connection.provider);
    try {
      await apiFetch<{ jobId: string; status: string }>(
        `/connections/${connection.id}/sync`,
        { method: "POST" }
      );
      setToast(`${PROVIDER_LABELS[connection.provider]} sync queued`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold hover:underline">
            Lead Manager
          </Link>
          <span className="text-sm text-gray-500">/</span>
          <span className="text-sm">Connections</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:underline"
          >
            Log out
          </button>
        </div>
      </header>

      {toast && (
        <div className="mb-4 px-4 py-2 bg-green-600 text-white rounded text-sm">
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-600 text-white rounded text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading connections...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const conn = getConnection(provider);
            const busy = actionLoading === provider;

            return (
              <div
                key={provider}
                className="border rounded-lg p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">
                    {PROVIDER_LABELS[provider]}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      conn
                        ? "bg-green-600/20 text-green-400"
                        : "bg-gray-600/20 text-gray-400"
                    }`}
                  >
                    {conn ? "Connected" : "Disconnected"}
                  </span>
                </div>

                {conn && conn.tokenExpiresAt && (
                  <p className="text-xs text-gray-500">
                    Token expires:{" "}
                    {new Date(conn.tokenExpiresAt).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2 mt-auto">
                  {conn ? (
                    <>
                      <button
                        onClick={() => handleSync(conn)}
                        disabled={busy}
                        className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busy ? "..." : "Sync"}
                      </button>
                      <button
                        onClick={() => handleDisconnect(conn)}
                        disabled={busy}
                        className="border border-red-500 text-red-500 rounded px-3 py-1.5 text-sm hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(provider)}
                      disabled={busy}
                      className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy ? "Redirecting..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
