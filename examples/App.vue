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
    this.imgSrc = require('./bizhi2.jpg');
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
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
  }
 #app {
   height: 100%;
 }
</style>
