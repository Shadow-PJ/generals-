// SteamPipe's app build script (session 7A): the file steamcmd reads to upload a build, naming
// the app, each depot (one for Windows, one for Linux and the Steam Deck) and the folder of files
// that goes into it. Pure: tools/steam/upload.ts writes it and runs steamcmd.

export interface Depot {
  /** The depot's id, from Steamworks (SteamPipe > Depots). */
  id: number;
  /** The folder to upload, relative to the content root. */
  folder: string;
}

export interface AppBuild {
  appId: number;
  /** Shown in the build list in Steamworks: the version and commit. */
  description: string;
  /** The folder the depots' folders are in. */
  contentRoot: string;
  /** Where steamcmd keeps its logs and cache for this build. */
  buildOutput: string;
  depots: readonly Depot[];
  /** A branch to set the build live on right away (never the default branch: that is done by hand in Steamworks). */
  setLive?: string | null;
  /** Checks the build and writes its logs, without uploading anything. */
  preview?: boolean;
}

/** VDF strings are quoted and taken as they are: no quotes, line breaks or backslashes inside. */
function quoted(value: string): string {
  if (/["\r\n\\]/.test(value)) throw new Error(`Not allowed in a SteamPipe script: ${JSON.stringify(value)}`);
  return `"${value}"`;
}

/** Paths with forward slashes, which steamcmd takes on every system. */
function slashes(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Problems with a build's settings, in words; empty when it can be uploaded. */
export function appBuildProblems(build: AppBuild): string[] {
  const problems: string[] = [];
  const id = (n: number) => Number.isSafeInteger(n) && n > 0;
  if (!id(build.appId)) problems.push('The App ID must be a positive whole number.');
  if (build.depots.length === 0) problems.push('There is no depot to upload.');
  for (const depot of build.depots) if (!id(depot.id)) problems.push(`The depot for ${depot.folder} has no valid id.`);
  if (new Set(build.depots.map((d) => d.id)).size !== build.depots.length) problems.push('Two depots have the same id.');
  if (build.setLive === 'default') problems.push('Set the default branch live by hand in Steamworks, not from a script.');
  return problems;
}

/** The app build script, as steamcmd reads it. */
export function appBuildVdf(build: AppBuild): string {
  const problems = appBuildProblems(build);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const lines = [
    '"AppBuild"',
    '{',
    `\t"AppID"\t${quoted(String(build.appId))}`,
    `\t"Desc"\t${quoted(build.description)}`,
    `\t"ContentRoot"\t${quoted(slashes(build.contentRoot))}`,
    `\t"BuildOutput"\t${quoted(slashes(build.buildOutput))}`,
    `\t"Preview"\t${quoted(build.preview ? '1' : '0')}`,
  ];
  if (build.setLive) lines.push(`\t"SetLive"\t${quoted(build.setLive)}`);
  lines.push('\t"Depots"', '\t{');
  for (const depot of build.depots) {
    lines.push(
      `\t\t${quoted(String(depot.id))}`,
      '\t\t{',
      '\t\t\t"FileMapping"',
      '\t\t\t{',
      `\t\t\t\t"LocalPath"\t${quoted(`${slashes(depot.folder).replace(/\/+$/, '')}/*`)}`,
      '\t\t\t\t"DepotPath"\t"."',
      '\t\t\t\t"recursive"\t"1"',
      '\t\t\t}',
      '\t\t}',
    );
  }
  lines.push('\t}', '}', '');
  return lines.join('\n');
}
