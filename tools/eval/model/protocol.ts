// What the eval page (page.ts, in the browser) and its driver (run.ts, in Node) say to each other.

export interface LoadReport {
  ms: number;
  bytes: number;
  threads: number;
  isolated: boolean;
}

export interface EvalPage {
  evalLoad(url: string, threads: number): Promise<LoadReport>;
  evalTranslate(text: string): Promise<{ raw: string; ms: number }>;
}
