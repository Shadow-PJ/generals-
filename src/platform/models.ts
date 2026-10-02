// The small open models the game can try for reading orders. Each downloads once on first use.

/** A model the game can try. */
export interface ModelChoice {
  id: string;
  name: string;
  url: string;
  /** Roughly, for the settings screen; the eval reports the real size. */
  sizeMb: number;
  license: string;
}

export const ORDER_MODELS: readonly ModelChoice[] = [
  {
    id: 'qwen2.5-0.5b',
    name: 'Qwen2.5 0.5B Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeMb: 400,
    license: 'Apache-2.0',
  },
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct',
    url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf',
    sizeMb: 390,
    license: 'Apache-2.0',
  },
];
