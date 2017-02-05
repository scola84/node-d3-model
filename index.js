import Model from './src/model';

const models = {};

export function model(path, singleton = false) {
  if (models[path]) {
    return models[path];
  }

  const instance = new Model().path(path);

  if (singleton === true) {
    models[path] = instance;
  }

  return instance;
}
