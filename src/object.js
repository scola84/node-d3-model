import Model from './model';

export default class ObjectModel extends Model {
  data(data) {
    return this
      .local(data)
      .remote(data);
  }

  id() {
    return this._parse(this._local);
  }

  parse() {
    const local = Object.assign({}, this._local);
    const path = this._parse(local);

    this._keys.forEach((key) => {
      delete local[key.name];
    });

    return [path, local];
  }

  insert(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new Error('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    const [path, local] = this.parse();

    this._connection
      .request()
      .method('POST')
      .path(path)
      .end(local, (response) => {
        this._handleInsert(response, callback);
      });
  }

  update(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new Error('500 model_state busy'));
      return;
    }

    this._state = 'busy';
    const [path, local] = this.parse();

    this._connection
      .request()
      .method('PUT')
      .path(path)
      .end(local, (response) => {
        this._handleUpdate(response, callback);
      });
  }

  delete(callback = () => {}) {
    if (this._state === 'busy') {
      callback(new Error('500 model_state busy'));
      return;
    }

    this._state = 'busy';

    this._connection
      .request()
      .method('DELETE')
      .path(this._path)
      .end(null, (response) => {
        this._handleDelete(response, callback);
      });
  }

  _handleInsert(response, callback) {
    if (response.status() !== 201) {
      this._state = 'idle';
      callback(new Error(response.status()));
      return;
    }

    this._handleResponse(response, (error, data) => {
      this._state = 'idle';
      this.emit('insert');
      callback(error, data);
    });
  }

  _handleUpdate(response, callback) {
    if (response.status() !== 200) {
      this._state = 'idle';
      callback(new Error(response.status()));
      return;
    }

    this._handleResponse(response, (error, data) => {
      this._state = 'idle';
      this.emit('update');
      callback(error, data);
    });
  }

  _handleDelete(response, callback) {
    if (response.status() !== 200) {
      callback(new Error(response.status()));
      return;
    }

    this.remove((error) => {
      this._state = 'idle';
      this.emit('delete');
      callback(error);
    });
  }
}
