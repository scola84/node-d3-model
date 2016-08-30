import ListModel from './src/list';
import ObjectModel from './src/object';

const lists = {};
const objects = {};

export function objectModel(name) {
  if (!objects[name]) {
    objects[name] = new ObjectModel();
  }

  return objects[name];
}

export function listModel(name) {
  if (!lists[name]) {
    lists[name] = new ListModel();
  }

  return lists[name];
}
