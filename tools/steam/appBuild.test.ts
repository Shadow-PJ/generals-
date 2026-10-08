import { describe, expect, it } from 'vitest';
import { appBuildProblems, appBuildVdf, type AppBuild } from './appBuild';

const build: AppBuild = {
  appId: 2468100,
  description: 'Generals 0.1.0 (abc1234)',
  contentRoot: 'C:\\Users\\Ali\\generals\\release',
  buildOutput: 'C:\\Users\\Ali\\generals\\release\\steam\\output',
  depots: [
    { id: 2468101, folder: 'win-unpacked' },
    { id: 2468102, folder: 'linux-unpacked/' },
  ],
};

describe('the SteamPipe app build script', () => {
  it('names the app, each depot and its folder, with forward slashes', () => {
    const vdf = appBuildVdf(build);
    expect(vdf).toContain('"AppID"\t"2468100"');
    expect(vdf).toContain('"ContentRoot"\t"C:/Users/Ali/generals/release"');
    expect(vdf).toContain('"Preview"\t"0"');
    expect(vdf).not.toContain('SetLive');
    expect(vdf).toContain('\t\t"2468101"\n\t\t{\n\t\t\t"FileMapping"\n\t\t\t{\n\t\t\t\t"LocalPath"\t"win-unpacked/*"');
    expect(vdf).toContain('"LocalPath"\t"linux-unpacked/*"');
    // Braces balance, as steamcmd needs.
    expect(vdf.split('{').length).toBe(vdf.split('}').length);
  });

  it('can check a build without uploading it, or set it live on a test branch', () => {
    expect(appBuildVdf({ ...build, preview: true })).toContain('"Preview"\t"1"');
    expect(appBuildVdf({ ...build, setLive: 'beta' })).toContain('"SetLive"\t"beta"');
  });

  it('refuses a build it can’t describe safely', () => {
    expect(appBuildProblems(build)).toEqual([]);
    expect(appBuildProblems({ ...build, appId: 0, depots: [] })).toEqual(['The App ID must be a positive whole number.', 'There is no depot to upload.']);
    expect(appBuildProblems({ ...build, depots: [build.depots[0]!, { id: 2468101, folder: 'x' }] })).toEqual(['Two depots have the same id.']);
    expect(appBuildProblems({ ...build, setLive: 'default' })).toHaveLength(1);
    expect(() => appBuildVdf({ ...build, description: 'say "hi"' })).toThrow(/Not allowed/);
  });
});
