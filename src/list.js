import Model from './model';

export default class ListModel extends Model {
  count(count) {
    return this._model.count(count);
  }

  meta(callback, force) {
    this._model
      .meta()
      .execute((error, data, list) => {
        this._handleMeta(error, data, list, callback);
      }, force);
  }

  page(callback, force) {
    this._model
      .page(this.get('index'))
      .select()
      .execute(callback, force);
  }

  _handleMeta(error, data, list, callback) {
    if (error) {
      callback(error);
      return;
    }

    callback(error, data, list);
  }

  _change(event) {
    this.emit('change', event);
  }
}
