import ListModel from './src/list';
import ObjectModel from './src/object';

const lists = {};
const objects = {};

export const MODE_NONE = 0;
export const MODE_SUB = 1;
export const MODE_UNSUB = 2;

export function objectModel(name) {
  if (!objects[name]) {
    objects[name] = new ObjectModel()
      .name(name);
  }

  return objects[name];
}

export function listModel(name) {
  if (!lists[name]) {
    lists[name] = new ListModel()
      .name(name);
  }

  return lists[name];
}
