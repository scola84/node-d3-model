import EventEmitter from 'events';

export default class Observer extends EventEmitter {
  constructor() {
    super();

    this._name = null;
    this._model = null;
    this._value = null;

    this._format = (v) => v;
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

  model(value = null) {
    if (value === null) {
      return this._model;
    }

    this._model = value;
    this._bindModel();

    return this;
  }

  format(value = null) {
    if (value === null) {
      return this._format;
    }

    this._format = value;
    return this;
  }

  value(itemValue = null) {
    if (itemValue === null) {
      return this._value;
    }

    this._value = itemValue;

    this._set({
      changed: false,
      name: this._name,
      value: this._model.get(this._name)
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
