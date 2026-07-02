const { uploadImage, resolveCloudFileUrls } = require('../../utils/cloud');

Component({
  properties: {
    maxCount: { type: Number, value: 9 },
    fileIds: { type: Array, value: [] },
    imageUrls: { type: Array, value: [] },
    cloudPathPrefix: { type: String, value: '' },
    singleFileName: { type: String, value: '' },
    circular: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false }
  },

  data: {
    uploading: false
  },

  methods: {
    async chooseImage() {
      if (this.data.disabled || this.data.uploading) return;
      const remain = this.data.maxCount - (this.data.fileIds || []).length;
      if (remain <= 0) {
        wx.showToast({ title: `最多上传${this.data.maxCount}张`, icon: 'none' });
        return;
      }

      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          this.setData({ uploading: true });
          this.triggerEvent('uploading', { uploading: true });
          const newIds = [...(this.data.fileIds || [])];
          const newUrls = [...(this.data.imageUrls || [])];
          const prefix = this.data.cloudPathPrefix || 'upload';

          for (const file of res.tempFiles) {
            const ext = file.tempFilePath.split('.').pop() || 'jpg';
            const cloudPath = this.data.singleFileName
              ? `${prefix}/${this.data.singleFileName}.${ext}`
              : `${prefix}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            try {
              const fileID = await uploadImage(file.tempFilePath, cloudPath);
              const [url] = await resolveCloudFileUrls([fileID]);
              newIds.push(fileID);
              newUrls.push(url || fileID);
            } catch (err) {
              console.error('上传失败:', err);
            }
          }

          this.setData({ uploading: false });
          this.triggerEvent('uploading', { uploading: false });
          this.triggerEvent('change', { fileIds: newIds, imageUrls: newUrls });
        }
      });
    },

    removeImage(e) {
      const index = e.currentTarget.dataset.index;
      const fileIds = [...(this.data.fileIds || [])];
      const imageUrls = [...(this.data.imageUrls || [])];
      fileIds.splice(index, 1);
      imageUrls.splice(index, 1);
      this.triggerEvent('change', { fileIds, imageUrls });
    },

    previewImage(e) {
      const index = e.currentTarget.dataset.index;
      const urls = this.data.imageUrls || [];
      if (!urls.length) return;
      wx.previewImage({ current: urls[index], urls });
    }
  }
});
