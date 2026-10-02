// The small model that reads free-form orders, running on the player's computer: llama.cpp
// compiled to WebAssembly (wllama), in a worker so the game keeps drawing. Both builds use it
// the same way. The model file downloads on first use and stays in the browser's cache; in
// session 3C the desktop app ships it inside the app instead. Nothing here costs money to run.

export { ORDER_MODELS, type ModelChoice } from './models';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LocalModel {
  /** How many CPU threads it runs on; more need a cross-origin isolated page. */
  readonly threads: number;
  /** The model's answer, forced to match the grammar (GBNF). */
  complete(messages: ChatTurn[], grammar: string, maxTokens: number): Promise<string>;
  unload(): Promise<void>;
}

export interface LoadOptions {
  /** CPU threads; leave out to use as many as the page allows. 1 forces single-threaded. */
  threads?: number;
  /** Run on the graphics card through WebGPU when the browser has it. */
  gpu?: boolean;
  onProgress?: (loaded: number, total: number) => void;
}

/** Downloads (or takes from the cache) and starts a model. The runtime itself loads only now, not with the game. */
export async function loadLocalModel(url: string, options: LoadOptions = {}): Promise<LocalModel> {
  const [{ Wllama }, wasm] = await Promise.all([
    import('@wllama/wllama/esm/index.js'),
    import('@wllama/wllama/esm/wasm/wllama.wasm?url').then((m) => m.default),
  ]);
  const wllama = new Wllama({ default: wasm }, { suppressNativeLog: true, allowOffline: true });
  await wllama.loadModelFromUrl(url, {
    // Room for the prompt with its worked examples, plus the answer.
    n_ctx: 4096,
    ...(options.threads ? { n_threads: options.threads } : {}),
    n_gpu_layers: options.gpu ? 999 : 0,
    progressCallback: ({ loaded, total }: { loaded: number; total: number }) => options.onProgress?.(loaded, total),
  });
  return {
    threads: wllama.getNumThreads(),
    async complete(messages, grammar, maxTokens) {
      // A grammar rather than response_format: wllama's JSON-schema conversion fails to start (3.8.1).
      const response = await wllama.createChatCompletion({ messages, max_tokens: maxTokens, temperature: 0, cache_prompt: true, grammar });
      return response.choices[0]?.message.content ?? '';
    },
    unload: () => wllama.exit(),
  };
}
