# This Python file uses the following encoding: utf-8
import jpype
jvmpath=jpype.getDefaultJVMPath()
print(jvmpath)
jpype.startJVM(jvmpath,'-ea',"-Djava.class.path=%s"%r'.\umr_annot_tool\main\FarasaSegmenterJar.jar')

Jclass=jpype.JClass('com.qcri.farasa.segmenter.Farasa')

# def get_lemmazation(string):
instance=Jclass()
# output=instance.lemmtizeLine()
output=instance.lemmatizeLine('يُشار إلى أن اللغة العربية يتحدثها أكثر من 422 مليون نسمة ويتوزع متحدثوها في المنطقة المعروفة باسم الوطن العربي بالإضافة إلى العديد من المناطق الأخرى المجاورة مثل الأهواز وتركيا وتشاد والسنغال وإريتريا وغيرها. وهي اللغة الرابعة من لغات منظمة الأمم المتحدة الرسمية الست.')
print(' '.join(output))

