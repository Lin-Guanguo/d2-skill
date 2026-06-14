import type { PublicCharacter } from '../inventory/inventory-view.js';
import type { PublicItem } from './item-model.js';

export interface CharacterTarget {
  characterId: string;
  label: string;
  source: 'owner' | 'current' | 'selector';
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function characterTarget(
  character: PublicCharacter,
  source: CharacterTarget['source'],
): CharacterTarget {
  return {
    characterId: character.characterId,
    label: character.class.name,
    source,
  };
}

function currentCharacter(characters: PublicCharacter[]) {
  const current = characters.find((character) => character.current);
  if (!current) {
    throw new Error('No current character was available in the profile snapshot.');
  }
  return current;
}

function findCharacter(characters: PublicCharacter[], selector: string) {
  const normalized = normalizeText(selector);
  return (
    characters.find((candidate) => candidate.characterId === selector) ??
    characters.find((candidate) => normalized === 'current' && candidate.current) ??
    characters.find((candidate) => candidate.class.key === normalized) ??
    characters.find((candidate) => normalizeText(candidate.class.name) === normalized)
  );
}

function selectedCharacter(characters: PublicCharacter[], selector: string) {
  const character = findCharacter(characters, selector);
  if (!character) {
    throw new Error(`Unknown character "${selector}". Use current, a class key/name, or a character id.`);
  }
  return characterTarget(character, selector === 'current' ? 'current' : 'selector');
}

function ownerCharacter(item: PublicItem, characters: PublicCharacter[]) {
  const character = item.owner.type === 'character' && item.owner.id
    ? characters.find((candidate) => candidate.characterId === item.owner.id)
    : undefined;
  return character ? characterTarget(character, 'owner') : undefined;
}

export function itemActionCharacter(
  item: PublicItem,
  characters: PublicCharacter[],
  selector?: string,
) {
  if (selector && selector !== 'owner') {
    return selectedCharacter(characters, selector);
  }

  return ownerCharacter(item, characters) ?? characterTarget(currentCharacter(characters), 'current');
}
