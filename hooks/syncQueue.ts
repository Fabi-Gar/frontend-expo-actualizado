import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventEmitter } from 'events';

type Job = {
  id: string;               
  type: 'create_incendio'; 
  payload: any;             
  createdAt: number;
};

const KEY = 'syncQueue:v1';
const bus = new EventEmitter();

export const SYNC_EVENTS = {
  QUEUE_CHANGED: 'QUEUE_CHANGED',
  FLUSH_OK: 'FLUSH_OK',
  FLUSH_ERR: 'FLUSH_ERR',
};

async function getQueue(): Promise<Job[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}
async function setQueue(arr: Job[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(arr));
  bus.emit(SYNC_EVENTS.QUEUE_CHANGED, arr.length);
}

export async function enqueue(job: Job) {
  const q = await getQueue();
  q.push(job);
  await setQueue(q);
}

export async function dequeueById(id: string) {
  const q = await getQueue();
  const next = q.filter(j => j.id !== id);
  await setQueue(next);
}

export async function peekAll() {
  return getQueue();
}

export function onQueueChange(cb: (len: number) => void) {
  const h = (len: number) => cb(len);
  bus.on(SYNC_EVENTS.QUEUE_CHANGED, h);
  return () => bus.off(SYNC_EVENTS.QUEUE_CHANGED, h);
}
