import Action from './src/action';
import Cache from './src/cache';
import Observable from './src/observable';
import Observer from './src/observer';
import State from './src/state';

const models = {};

function action() {
  return new Action();
}

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
  Action,
  Cache,
  Observable,
  Observer,
  State,
  action,
  cache,
  model,
  state
};
