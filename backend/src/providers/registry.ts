import type { ISourceProvider } from "./types";

const providers = new Map<string, ISourceProvider>();

export function registerProvider(provider: ISourceProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): ISourceProvider | undefined {
  return providers.get(id);
}

export function getAllProviders(): ISourceProvider[] {
  return Array.from(providers.values());
}
