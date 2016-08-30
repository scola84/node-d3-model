import { EventEmitter } from '@scola/events';
import get from 'lodash-es/get';
import set from 'lodash-es/set';
import merge from 'lodash-es/merge';
import odiff from 'odiff';

export default class Model extends EventEmitter {
  constructor() {
    super();

    this._models = new Set();

    this._subscribe = false;
    this._model = null;

    this._origin = {};
    this._values = {};

    this._handleChange = (e) => this._change(e);
  }

  destroy() {
    if (this._model) {
      this._unbindModel(this._model);
    }

    this._models.forEach((model) => {
      model.destroy();
    });

    this._models.clear();

    this._subscribe = false;
    this._model = null;

    this._origin = {};
    this._values = {};
  }

  subscribe(subscribe) {
    this._subscribe = subscribe;
    return this;
  }

  get(name) {
    return get(this._values, name);
  }

  set(name, value) {
    set(this._values, name, value);

    this.emit('change', {
      action: 'set',
      name,
      value
    });

    return this;
  }

  add(name, value, action) {
    const values = this.get(name) || [];

    if (action === true) {
      values.push(value);
    } else if (action === false) {
      values.splice(values.indexOf(value), 1);
    }

    return this.set(name, values.sort());
  }

  values(values) {
    if (typeof values === 'undefined') {
      return this._values;
    }

    this._values = merge({}, values);
    return this.commit();
  }

  diff() {
    return odiff(this._origin, this._values);
  }

  commit() {
    merge(this._origin, this._values);
    return this;
  }

  rollback() {
    merge(this._values, this._origin);

    this.emit('change', {
      action: 'rollback'
    });

    return this;
  }

  model(model) {
    if (this._model) {
      this._unbindModel(this._model);
    }

    if (!this._models.has(model)) {
      this._models.add(model);

      if (this._subscribe) {
        model.subscribe(true);
      }
    }

    this._model = model;

    this._bindModel(this._model);
    return this;
  }

  _bindModel(model) {
    model.addListener('change', this._handleChange);
  }

  _unbindModel(model) {
    model.removeListener('change', this._handleChange);
  }

  _change() {
    throw new Error('Not implemented');
  }
}
