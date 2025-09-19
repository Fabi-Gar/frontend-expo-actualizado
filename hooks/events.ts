type Handler = (payload?: any) => void;

const listeners = new Map<string, Set<Handler>>();

export const EVENTS = {
    INCENDIO_CREATED: 'INCENDIO_CREATED',
    INCENDIO_UPDATED: 'INCENDIO_UPDATED',
    INCENDIO_DELETED: 'INCENDIO_DELETED',
    REPORT_ADDED: 'REPORT_ADDED',
    PHOTOS_UPLOADED: 'PHOTOS_UPLOADED',
} as const;

export function emit(eventName: string, payload?: any) {
    const set = listeners.get(eventName);
    if (!set) return;
    for (const fn of set) fn(payload);
}

export function subscribe(eventName: string, handler: Handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName)!.add(handler);
    return () => listeners.get(eventName)!.delete(handler);
}
