const {readFile, writeFile} = require('fs');
const pathUtil = require('path');

class FileSystem {
	constructor (path) {
		this.path = path;
		this.name = pathUtil.basename(this._path);
	}
	
   async readAsArrayBuffer (blob) {
		const fileReader = new FileReader();
		fileReader.onload = () => return fr.result;
		fileReader.onerror = e => return new Error('cannot read:' + e);
		await fileReader.readAsArrayBuffer(blob);
   }
	
   async write (content) {
		if (content instanceof Blob) {
			const arrayBuffer = await this.readAsArrayBuffer(content);
			await writeFile(this.path, Buffer.from(new Uint8Array(arrayBuffer)));
			return 'success';
        }
        else return new Error ('content is not a blob');
   }
   
   async getFile () {
    const data = await readFile(this._path);
    const blob = new Blob([data.buffer]);
    return new File([blob], this.name);
  }
}