// 全部真实图片必须在浏览器解码成功，切换完成后仍固定在点位原点。
window.qaThreeStyles=(async()=>{
  const ids=['living','dining','kitchen','master','bedroom-north','bedroom-south','small-room','balcony','bath-west','bath-east','entrance'];
  const rows=[];
  for(const theme of ['warm','minimal','urban']){
    await panoramaViewer.switchTheme(theme);
    for(const id of ids){
      await panoramaViewer.navigate(id);
      if(panoramaViewer.current!==id||panoramaViewer.theme!==theme||panoramaViewer.cachedTextures>3||panoramaViewer.camera.position.length()!==0)throw Error('点位或风格状态异常：'+theme+'/'+id);
      rows.push(theme+'/'+id);
    }
  }
  await panoramaViewer.navigate('living');
  await panoramaViewer.switchTheme('warm');
  window.qaThreeStylesResult={loaded:rows.length,rows,cache:panoramaViewer.cachedTextures};
})().catch(error=>{window.qaThreeStylesError=error.message;throw error;});
