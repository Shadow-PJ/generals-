// Seeds for new battles. The game may use real randomness to pick one; only the battle
// engine must not. The result screen shows the seed, so a battle can be looked into later.

export function newSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}
