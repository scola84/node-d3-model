import Model from './src/model';
const models = {};

export function model(name) {
  if (!models[name]) {
    models[name] = new Model();
  }

  return models[name];
}
