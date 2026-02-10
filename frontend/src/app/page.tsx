"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./context/AuthContext";
import { apiFetch } from "./lib/api";

interface Contact {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  sourceUpdatedAt: string | null;
  systemUpdatedAt: string;
}

export default function Home() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch<Contact[]>("/contacts")
        .then(setContacts)
        .catch((err: any) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  function formatName(c: Contact) {
    const parts = [c.firstName, c.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "—";
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString();
  }

  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold">Lead Manager</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/connections"
            className="text-sm text-blue-500 hover:underline"
          >
            Connections
          </Link>
          <span className="text-sm">{user?.email}</span>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:underline"
          >
            Log out
          </button>
        </div>
      </header>

      <main>
        {error && (
          <div className="mb-4 px-4 py-2 bg-red-600 text-white rounded text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">No contacts yet.</p>
            <p className="text-sm text-gray-400">
              <Link href="/connections" className="text-blue-500 hover:underline">
                Connect a provider
              </Link>{" "}
              and sync to import contacts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b hover:bg-white/5 cursor-pointer"
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                  >
                    <td className="py-2.5 pr-4">{formatName(contact)}</td>
                    <td className="py-2.5 pr-4">{contact.email || "—"}</td>
                    <td className="py-2.5 pr-4">{contact.phone || "—"}</td>
                    <td className="py-2.5">
                      {formatDate(contact.sourceUpdatedAt || contact.systemUpdatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

    </div>
  );
}
