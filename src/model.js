import { EventEmitter } from 'events';

export default class Model extends EventEmitter {
  constructor() {
    super();

    this._name = null;
    this._models = new Set();
    this._model = null;
    this._mode = 0;

    this._handleChange = (e) => this._change(e);
    this._handleOpen = (e) => this._open(e);
  }

  destroy() {
    if (this._model) {
      this._unbindModel(this._model);
    }

    this._models.forEach((model) => {
      model.destroy(true);
    });

    this._models.clear();
    this._model = null;
  }

  name(value) {
    this._name = value;
    return this;
  }

  mode(value) {
    this._mode = value;
    return this;
  }

  model(value) {
    if (this._model) {
      this._unbindModel(this._model);

      if (this._mode > 1) {
        this._model.destroy(true);
        this._models.delete(this._model);
      }
    }

    if (!this._models.has(value)) {
      this._models.add(value);

      if (this._mode > 0) {
        value.subscribe(true);
      }
    }

    this._model = value;
    this._bindModel(this._model);

    return this;
  }

  _bindModel(model) {
    model.addListener('change', this._handleChange);
    model.addListener('open', this._handleOpen);
  }

  _unbindModel(model) {
    model.removeListener('change', this._handleChange);
    model.removeListener('open', this._handleOpen);
  }

  _change(event) {
    this.emit('change', event);
  }

  _open(event) {
    this.emit('open', event);
  }
}
