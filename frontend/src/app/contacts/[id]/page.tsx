"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import ChatCard from "../../components/ChatCard";

interface SourceContact {
  connectionId: string;
  providerId: string;
  provider: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  raw: Record<string, unknown> | null;
  sourceUpdatedAt: string | null;
  systemUpdatedAt: string;
}

interface Interaction {
  connectionId: string;
  interactionId: string;
  providerId: string;
  entityType: string | null;
  contentText: string | null;
  raw: Record<string, unknown> | null;
  sourceUpdatedAt: string | null;
  systemUpdatedAt: string;
}

interface ContactDetail {
  id: string;
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  sourceUpdatedAt: string | null;
  systemUpdatedAt: string;
  sources: SourceContact[];
  interactions: Interaction[];
}

const PROVIDER_LABELS: Record<string, string> = {
  hubspot: "HubSpot",
  pipedrive: "Pipedrive",
  zendesk: "Zendesk",
};

export default function ContactDetailPage() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && contactId) {
      apiFetch<ContactDetail>(`/contacts/${contactId}`)
        .then(setContact)
        .catch((err: any) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, contactId]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  function formatName(c: ContactDetail) {
    const parts = [c.firstName, c.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unknown";
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString();
  }

  return (
    <div className="min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xl font-bold hover:underline">
            Lead Manager
          </Link>
          <span className="text-sm text-gray-500">/</span>
          <span className="text-sm">Contact</span>
        </div>
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

      <div className="mb-4">
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          &larr; Back to contacts
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-600 text-white rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading contact...</p>
      ) : !contact ? (
        <p className="text-gray-500">Contact not found.</p>
      ) : (
        <div className="space-y-8">
          {/* Golden record header */}
          <section>
            <h2 className="text-2xl font-bold mb-2">{formatName(contact)}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
              {contact.email && <span>{contact.email}</span>}
              {contact.phone && <span>{contact.phone}</span>}
              <span>Updated {formatDate(contact.sourceUpdatedAt || contact.systemUpdatedAt)}</span>
            </div>
          </section>

          {/* Sources */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Sources</h3>
            {contact.sources.length === 0 ? (
              <p className="text-sm text-gray-500">No source contacts.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contact.sources.map((src) => (
                  <div
                    key={`${src.connectionId}-${src.providerId}`}
                    className="border rounded-lg p-4 space-y-1"
                  >
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400">
                      {PROVIDER_LABELS[src.provider] || src.provider}
                    </span>
                    {src.companyName && (
                      <p className="text-sm mt-2">{src.companyName}</p>
                    )}
                    {src.jobTitle && (
                      <p className="text-sm text-gray-400">{src.jobTitle}</p>
                    )}
                    {src.email && <p className="text-xs text-gray-500">{src.email}</p>}
                    {src.phone && <p className="text-xs text-gray-500">{src.phone}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Interactions */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Interactions</h3>
            {contact.interactions.length === 0 ? (
              <p className="text-sm text-gray-500">No interactions recorded.</p>
            ) : (
              <div className="space-y-3">
                {contact.interactions.map((ix) => (
                  <div
                    key={`${ix.connectionId}-${ix.interactionId}`}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {ix.entityType && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-600/20 text-gray-400">
                          {ix.entityType}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatDate(ix.sourceUpdatedAt)}
                      </span>
                    </div>
                    {ix.contentText && (
                      <p className="text-sm whitespace-pre-wrap mt-1">
                        {ix.contentText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {chatOpen ? (
        <ChatCard onClose={() => setChatOpen(false)} contactId={contactId} />
      ) : (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-blue-700 z-50"
        >
          ?
        </button>
      )}
    </div>
  );
}
