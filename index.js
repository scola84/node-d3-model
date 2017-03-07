import Observable from './src/observable';
import Observer from './src/observer';

const models = {};

function model(path, singleton = false) {
  if (models[path]) {
    return models[path];
  }

  const instance = new Observable()
    .path(path);

  if (singleton === true) {
    models[path] = instance;
  }

  return instance;
}

export {
  Observable,
  Observer,
  model
};
