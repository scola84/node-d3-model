import Cache from './src/cache';
import Observable from './src/observable';
import Observer from './src/observer';
import State from './src/state';

const models = {};

function cache() {
  return new Cache();
}

function model(path, singleton = false) {
  if (models[path] instanceof Observable === true) {
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
  Cache,
  Observable,
  Observer,
  State,
  cache,
  model,
  state
};
