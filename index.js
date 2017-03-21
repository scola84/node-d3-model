import Observable from './src/observable';
import Observer from './src/observer';
import State from './src/state';

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

function state() {
  return new State();
}

export {
  Observable,
  Observer,
  State,
  model,
  state
};
