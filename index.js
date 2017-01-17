import Model from './src/model';

const models = {};

export function model(path, singleton) {
  if (singleton === false) {
    return new Model()
      .path(path);
  }

  if (!models[path]) {
    models[path] = new Model()
      .path(path);
  }

  return models[path];
}
