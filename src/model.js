import EventEmitter from 'events';
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

    this._handleChange = () => this._change();
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
      diff: this.diff()
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

    this._values = values;
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
    this.emit('change');

    return this;
  }

  model(model) {
    if (this._model) {
      this._unbindModel(this._model);
    }

    this._model = model;
    this._models.add(this._model);

    this._bindModel(this._model);

    return this;
  }

  select(callback) {
    this._model
      .select()
      .execute((error, data) => {
        this._handleSelect(error, data, callback);
      });
  }

  insert(callback) {
    this._model
      .insert()
      .execute(this._values, callback);
  }

  update(callback) {
    this._model
      .update()
      .execute(this._values, callback);
  }

  delete(callback) {
    this._model
      .delete()
      .execute(callback);
  }

  getMaxListeners() {
    if (typeof this._maxListeners === 'undefined') {
      return EventEmitter.defaultMaxListeners;
    }

    return this._maxListeners;
  }

  _bindModel(model) {
    model.addListener('change', this._handleChange);
  }

  _unbindModel(model) {
    model.removeListener('change', this._handleChange);
  }

  _handleSelect(error, data, callback) {
    if (error) {
      callback(error);
      return;
    }

    this._change(null, data);

    if (this._subscribe) {
      this._model.subscribe(true);
    }

    callback(null, this._model);
  }

  _change(diff, data) {
    this.values(data);
    this.emit('change');
  }
}
