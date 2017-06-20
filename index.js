import Cache from './src/cache';
import Observable from './src/observable';
import Observer from './src/observer';
import State from './src/state';

const models = {};

function cache() {
  return new Cache();
}

function model(path, singleton = false) {
  if (singleton === false) {
    return new Observable()
      .path(path);
  }

  if (models[path] instanceof Observable === true) {
    return models[path];
  }

  models[path] = new Observable()
    .path(path);

  return models[path];
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
