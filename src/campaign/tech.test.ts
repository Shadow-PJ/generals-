import { describe, expect, it } from 'vitest';
import { SPEC_COST, TECH_NODES } from '../data/tech';
import { newCampaign } from './company';
import { newRun } from './run';
import { buyTech, hasTech, respecProblem, respecTech, techChoice, techProblem, techSpecs, techSpent } from './tech';
import type { Campaign } from './types';

const rich: Campaign = { ...newCampaign(), insight: 100 };

describe('the Tech Web', () => {
  it('sells Drills and Better Arms first, then one specialization of the class, then Honed Skill', () => {
    expect(techProblem(rich, 'vanguard', 'breaker')).toMatch(/Drills or Better Arms/);
    expect(techProblem(rich, 'vanguard', 'honed')).toMatch(/specialization/);
    let c = buyTech(rich, 'vanguard', 'arms');
    expect(c.insight).toBe(100 - TECH_NODES.arms.cost);
    expect(techProblem(c, 'vanguard', 'sniper')).toMatch(/Not this class/);
    c = buyTech(c, 'vanguard', 'breaker');
    expect(techProblem(c, 'vanguard', 'bulwark')).toMatch(/One specialization/);
    c = buyTech(c, 'vanguard', 'honed');
    expect(hasTech(c.tech, 'vanguard', 'honed')).toBe(true);
    expect(techProblem(c, 'vanguard', 'arms')).toMatch(/Already/);
    expect(techSpent(c.tech, 'vanguard')).toBe(TECH_NODES.arms.cost + SPEC_COST + TECH_NODES.honed.cost);
  });

  it('costs Insight you have, and only for classes you have unlocked', () => {
    expect(techProblem({ ...rich, insight: 1 }, 'ranger', 'drills')).toMatch(/Insight/);
    expect(techProblem(rich, 'assassin', 'drills')).toMatch(/Unlock/);
    expect(techProblem({ ...rich, bossesBeaten: ['hiveMother'] }, 'assassin', 'drills')).toBeNull();
  });

  it('gives campaign battles its specializations and nodes, by class', () => {
    let c = buyTech(rich, 'ranger', 'drills');
    c = buyTech(c, 'ranger', 'sniper');
    c = buyTech(c, 'guardian', 'arms');
    expect(techSpecs(c.tech)).toEqual({ ranger: 'sniper' });
    expect(techChoice(c.tech)).toEqual({ ranger: ['drills'], guardian: ['arms'] });
  });

  it('takes a class’s web back for all its Insight, free, but only between runs', () => {
    let c = buyTech(buyTech(rich, 'ranger', 'drills'), 'ranger', 'volley');
    expect(respecProblem(rich, 'ranger')).toMatch(/Nothing/);
    expect(respecProblem(newRun(c, 'deepForest', 1), 'ranger')).toMatch(/between runs/);
    c = respecTech(c, 'ranger');
    expect(c.insight).toBe(100);
    expect(c.tech.ranger).toBeUndefined();
  });
});
