!macro customInstall
    #WriteRegStr HKCR "clipcc" "" "URL:clipcc"
    #WriteRegStr HKCR "clipcc" "URL Protocol" ""
    #WriteRegStr HKCR "clipcc\shell\open\command" "" '"$INSTDIR\ClipCC 3.exe"'
    
    WriteRegStr HKCR ".sb2" "" "clipcc.sb2"
    WriteRegStr HKCR ".sb2" "Content Type" "application/x-zip-compressed"
    WriteRegStr HKCR ".sb2" "PerceivedType" "compressed"
    WriteRegStr HKCR ".sb2\OpenWithProgIds" "clipcc.sb2" ""
    
    WriteRegStr HKCR ".sb3" "" "clipcc.sb3"
    WriteRegStr HKCR ".sb3" "Content Type" "application/x-zip-compressed"
    WriteRegStr HKCR ".sb3" "PerceivedType" "compressed"
    WriteRegStr HKCR ".sb3\OpenWithProgIds" "clipcc.sb3" ""
    
    WriteRegStr HKCR "clipcc.sb2" "" "Scratch 2 Project"
    WriteRegStr HKCR "clipcc.sb2\DefaultIcon" "" '"$INSTDIR\resources\icon\sb2.ico"'
    #WriteRegStr HKCR "clipcc.sb2\shell\open\command" "" '"$INSTDIR\ClipCC 3.exe" "%1"'
    
    WriteRegStr HKCR "clipcc.sb3" "" "Scratch 3 Project"
    WriteRegStr HKCR "clipcc.sb3\DefaultIcon" "" '"$INSTDIR\resources\icon\sb3.ico"'
    #WriteRegStr HKCR "clipcc.sb2\shell\open\command" "" '"$INSTDIR\ClipCC 3.exe" "%1"'
!macroend
