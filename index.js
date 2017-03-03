import Model from './src/model';
import Observer from './src/observer';

const models = {};

function model(path, singleton = false) {
  if (models[path]) {
    return models[path];
  }

  const instance = new Model().path(path);

  if (singleton === true) {
    models[path] = instance;
  }

  return instance;
}

export {
  Observer,
  model
};
