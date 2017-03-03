import EventEmitter from 'events';

export default class Observer extends EventEmitter {
  constructor() {
    super();

    this._name = null;
    this._model = null;
    this._format = null;

    this._handleSet = (e) => this._set(e);
  }

  destroy() {
    this._unbindModel();
  }

  name(value) {
    if (value === null) {
      return this._name;
    }

    this._name = value;
    return this;
  }

  model(value = null, format = (v) => v) {
    if (value === null) {
      return this._model;
    }

    this._model = value;
    this._format = format;

    this._bindModel();
    this._set({
      name: this._name,
      scope: 'model',
      value: value.get(this._name)
    });

    return this;
  }

  _bindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() + 1);
      this._model.addListener('set', this._handleSet);
    }
  }

  _unbindModel() {
    if (this._model) {
      this._model.setMaxListeners(this._model.getMaxListeners() - 1);
      this._model.removeListener('set', this._handleSet);
    }
  }

  _set() {}
}
