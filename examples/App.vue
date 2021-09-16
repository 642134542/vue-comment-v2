<template>
  <div id="app">
    <vue-comment :src="imgSrc"
                 @saveJson="saveJson"
                 @savePng="savePng"></vue-comment>
  </div>
</template>

<script>
export default {
  name: 'App',
  components: {
  },
  data() {
    return {
      imgSrc: '',
    };
  },
  created() {
    this.imgSrc = `http://192.168.0.27:8088/group1/2021/08/25/5wy9v1.jpg?${+new Date().getTime()}`;
  },
  methods: {
    saveJson(data) {
      console.log('sasa', JSON.stringify(data));
    },
    savePng(dataURL) {
      const link = document.createElement('a');
      link.download = 'ceshi.png';
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  },
};
</script>

<style>

</style>
