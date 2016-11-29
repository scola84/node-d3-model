import ListModel from './src/list';
import ObjectModel from './src/object';

const lists = {};
const objects = {};

export { ListModel, ObjectModel };

export function objectModel(path) {
  if (!objects[path]) {
    objects[path] = new ObjectModel().path(path);
  }

  return objects[path];
}

export function listModel(path) {
  if (!lists[path]) {
    lists[path] = new ListModel().path(path);
  }

  return lists[path];
}
