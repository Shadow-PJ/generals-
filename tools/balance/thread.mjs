// The worker thread's entry: Node runs plain JavaScript here, so it turns on tsx to load the TypeScript worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
