import Model from './src/model';

export { default as Observer } from './src/observer';

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
