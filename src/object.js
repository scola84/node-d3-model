import Model from './model';

export default class ObjectModel extends Model {
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

  _handleSelect(error, data, callback) {
    if (error) {
      callback(error);
      return;
    }

    this._change({
      action: 'select',
      data
    });

    callback(null, data, this._model);
  }

  _change(event) {
    this.values(event.data);
    this.emit('change', event);
  }
}
