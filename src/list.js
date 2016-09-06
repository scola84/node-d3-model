import Model from './model';

export default class ListModel extends Model {
  count(value) {
    return this._model.count(value);
  }

  meta(callback, force) {
    this._model
      .meta()
      .execute((error, data, list) => {
        this._handleMeta(error, data, list, callback);
      }, force);
  }

  page(index, callback, force) {
    this._model
      .page(index)
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
}
