const cache = new Map<string, string | null>();

export function setPhotoCache(id: string, url: string | null) {
    cache.set(id, url ?? null);
}
export function getPhotoCache(id: string): string | null | undefined {
    return cache.get(id);
}
