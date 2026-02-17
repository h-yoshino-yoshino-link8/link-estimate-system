'=============================================================
' 見積原価管理システム - VBAマクロ
' Module: 新規案件作成 + PDF出力
' 株式会社LinK
' 対応環境: Mac / Windows
'=============================================================

Option Explicit

'-------------------------------------------------------------
' デスクトップパスを取得（Mac/Windows両対応）
'-------------------------------------------------------------
Private Function GetDesktopPath() As String
    #If Mac Then
        GetDesktopPath = Environ("HOME") & "/Desktop/"
    #Else
        GetDesktopPath = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\"
    #End If
End Function

'-------------------------------------------------------------
' 禁則文字を除去してファイル名として安全な文字列にする
'-------------------------------------------------------------
Private Function SanitizeFileName(ByVal rawName As String, ByVal fallbackName As String) As String
    Dim invalidChars As Variant
    Dim ch As Variant
    Dim cleaned As String

    cleaned = Trim$(rawName)
    invalidChars = Array("\", "/", ":", "*", "?", """", "<", ">", "|", vbCr, vbLf, vbTab)

    For Each ch In invalidChars
        cleaned = Replace(cleaned, CStr(ch), "_")
    Next ch

    Do While InStr(cleaned, "__") > 0
        cleaned = Replace(cleaned, "__", "_")
    Loop

    cleaned = Trim$(cleaned)
    If cleaned = "" Then cleaned = fallbackName

    SanitizeFileName = cleaned
End Function

'-------------------------------------------------------------
' 禁則文字を除去してシート名として安全な文字列にする
'-------------------------------------------------------------
Private Function SanitizeSheetName(ByVal rawName As String, ByVal fallbackName As String) As String
    Dim invalidChars As Variant
    Dim ch As Variant
    Dim cleaned As String

    cleaned = Trim$(rawName)
    invalidChars = Array("/", "\", ":", "*", "?", "[", "]")

    For Each ch In invalidChars
        cleaned = Replace(cleaned, CStr(ch), "_")
    Next ch

    cleaned = Replace(cleaned, vbCr, " ")
    cleaned = Replace(cleaned, vbLf, " ")
    cleaned = Replace(cleaned, vbTab, " ")

    Do While InStr(cleaned, "  ") > 0
        cleaned = Replace(cleaned, "  ", " ")
    Loop

    cleaned = Trim$(cleaned)
    If cleaned = "" Then cleaned = fallbackName

    If Len(cleaned) > 31 Then cleaned = Left$(cleaned, 31)

    SanitizeSheetName = cleaned
End Function

'-------------------------------------------------------------
' ワークシート存在チェック
'-------------------------------------------------------------
Private Function WorksheetExists(ByVal wsName As String, Optional ByVal wb As Workbook) As Boolean
    Dim targetBook As Workbook
    Dim ws As Worksheet

    If wb Is Nothing Then
        Set targetBook = ThisWorkbook
    Else
        Set targetBook = wb
    End If

    On Error Resume Next
    Set ws = targetBook.Worksheets(wsName)
    On Error GoTo 0

    WorksheetExists = Not ws Is Nothing
End Function

'-------------------------------------------------------------
' P-XXX形式を数値にパースする
'-------------------------------------------------------------
Private Function TryParseProjectId(ByVal projectId As String, ByRef outNumber As Long) As Boolean
    Dim trimmedId As String
    Dim numberPart As String

    trimmedId = Trim$(projectId)
    If Len(trimmedId) < 3 Then Exit Function
    If UCase$(Left$(trimmedId, 2)) <> "P-" Then Exit Function

    numberPart = Mid$(trimmedId, 3)
    If numberPart = "" Then Exit Function
    If numberPart Like "*[!0-9]*" Then Exit Function

    outNumber = CLng(numberPart)
    TryParseProjectId = True
End Function

'-------------------------------------------------------------
' 案件管理A列から次の案件IDを算出する（異常値は無視）
'-------------------------------------------------------------
Private Function GetNextProjectId(ByVal ws案件管理 As Worksheet) As String
    Dim lastRow As Long
    Dim i As Long
    Dim currentNumber As Long
    Dim maxNumber As Long
    Dim cellValue As String

    maxNumber = 0
    lastRow = ws案件管理.Cells(ws案件管理.Rows.Count, "A").End(xlUp).Row
    If lastRow < 5 Then
        GetNextProjectId = "P-001"
        Exit Function
    End If

    For i = 5 To lastRow
        cellValue = CStr(ws案件管理.Cells(i, 1).Value)
        If TryParseProjectId(cellValue, currentNumber) Then
            If currentNumber > maxNumber Then maxNumber = currentNumber
        End If
    Next i

    GetNextProjectId = "P-" & Format$(maxNumber + 1, "000")
End Function

'-------------------------------------------------------------
' 衝突しないシート名を返す（必要に応じて "_2" などを付与）
'-------------------------------------------------------------
Private Function BuildUniqueSheetName(ByVal baseName As String, ByVal wb As Workbook) As String
    Dim candidate As String
    Dim suffix As String
    Dim counter As Long

    candidate = baseName
    If Len(candidate) > 31 Then candidate = Left$(candidate, 31)

    If Not WorksheetExists(candidate, wb) Then
        BuildUniqueSheetName = candidate
        Exit Function
    End If

    counter = 2
    Do
        suffix = "_" & CStr(counter)
        candidate = Left$(baseName, 31 - Len(suffix)) & suffix
        counter = counter + 1
    Loop While WorksheetExists(candidate, wb)

    BuildUniqueSheetName = candidate
End Function

'-------------------------------------------------------------
' シート名からExcel参照用のシングルクォートをエスケープ
'-------------------------------------------------------------
Private Function EscapeSheetNameForFormula(ByVal sheetName As String) As String
    EscapeSheetNameForFormula = Replace(sheetName, "'", "''")
End Function

'-------------------------------------------------------------
' 新規案件作成メイン処理
' 操作パネルの「新規案件作成」ボタンから呼び出す
'-------------------------------------------------------------
Public Sub 新規案件作成()
    Dim ws案件管理 As Worksheet
    Dim wsテンプレート As Worksheet
    Dim ws操作パネル As Worksheet
    Dim ws新規 As Worksheet
    Dim wsS表紙 As Worksheet
    Dim insertAfter As Worksheet

    Dim nextID As String
    Dim 顧客ID As String
    Dim 顧客名 As String
    Dim 物件名 As String
    Dim 施工住所 As String
    Dim 担当者 As String
    Dim 目標粗利率 As Double
    Dim confirmMsg As String
    Dim newSheetName As String
    Dim escapedSheetName As String
    Dim newRow As Long

    Dim oldScreenUpdating As Boolean
    Dim templateWasHidden As Boolean
    oldScreenUpdating = Application.ScreenUpdating
    templateWasHidden = False

    On Error GoTo ErrHandler

    Set ws案件管理 = ThisWorkbook.Sheets("案件管理")
    Set wsテンプレート = ThisWorkbook.Sheets("案件テンプレート")
    Set ws操作パネル = ThisWorkbook.Sheets("操作パネル")
    Set wsS表紙 = ThisWorkbook.Sheets("Ｓ表紙")

    '--- 1. 次の案件IDを自動採番 ---
    nextID = GetNextProjectId(ws案件管理)

    '--- 2. 入力フォーム ---
    顧客ID = Trim$(CStr(ws操作パネル.Range("B7").Value))
    If 顧客ID = "" Then
        MsgBox "操作パネルのB7に顧客IDを選択してください。" & vbCrLf & _
               "（ドロップダウンから選べます）", vbExclamation, "入力エラー"
        ws操作パネル.Activate
        ws操作パネル.Range("B7").Select
        GoTo SafeExit
    End If

    顧客名 = Trim$(CStr(ws操作パネル.Range("D7").Value))

    物件名 = Trim$(InputBox("物件名を入力してください:" & vbCrLf & _
                             "（例: 吉野様邸 キッチンリフォーム）" & vbCrLf & vbCrLf & _
                             "顧客: " & 顧客名 & "（" & 顧客ID & "）" & vbCrLf & _
                             "案件ID: " & nextID, _
                             "新規案件作成 - Step 1/3"))
    If 物件名 = "" Then GoTo SafeExit

    施工住所 = Trim$(InputBox("施工住所を入力してください:" & vbCrLf & _
                               "（例: 東京都江戸川区北葛西1-2-22）" & vbCrLf & vbCrLf & _
                               "※ 空欄でもOK（後から入力できます）", _
                               "新規案件作成 - Step 2/3"))

    担当者 = Trim$(CStr(ws操作パネル.Range("B9").Value))
    If 担当者 = "" Then 担当者 = "吉野博"

    If IsNumeric(ws操作パネル.Range("D9").Value) Then
        目標粗利率 = CDbl(ws操作パネル.Range("D9").Value)
    Else
        目標粗利率 = 0.25
    End If
    If 目標粗利率 <= 0 Then 目標粗利率 = 0.25

    confirmMsg = "以下の内容で案件を作成します:" & vbCrLf & vbCrLf & _
                 "案件ID: " & nextID & vbCrLf & _
                 "顧客: " & 顧客名 & "（" & 顧客ID & "）" & vbCrLf & _
                 "物件名: " & 物件名 & vbCrLf & _
                 "施工住所: " & IIf(施工住所 = "", "（未入力）", 施工住所) & vbCrLf & _
                 "担当者: " & 担当者 & vbCrLf & _
                 "目標粗利率: " & Format$(目標粗利率, "0%") & vbCrLf & vbCrLf & _
                 "よろしいですか？"

    If MsgBox(confirmMsg, vbYesNo + vbQuestion, "新規案件作成 - Step 3/3") = vbNo Then GoTo SafeExit

    '--- 3. 案件テンプレートをコピー ---
    Application.ScreenUpdating = False

    templateWasHidden = (wsテンプレート.Visible <> xlSheetVisible)
    If templateWasHidden Then wsテンプレート.Visible = xlSheetVisible

    newSheetName = SanitizeSheetName(nextID & "_" & 物件名, nextID & "_案件")
    newSheetName = BuildUniqueSheetName(newSheetName, ThisWorkbook)

    ' P-003_吉野様邸キッチンの後に入れる（なければテンプレートの後）
    On Error Resume Next
    Set insertAfter = ThisWorkbook.Sheets("P-003_吉野様邸キッチン")
    On Error GoTo ErrHandler
    If insertAfter Is Nothing Then Set insertAfter = wsテンプレート

    wsテンプレート.Copy After:=insertAfter
    Set ws新規 = ActiveSheet
    ws新規.Name = newSheetName

    If templateWasHidden Then
        wsテンプレート.Visible = xlSheetHidden
        templateWasHidden = False
    End If

    ws新規.Range("B3").Value = nextID
    ws新規.Range("B4").Value = 物件名
    ws新規.Range("B5").Value = 顧客名
    ws新規.Range("B7").Value = 目標粗利率

    '--- 4. 案件管理に新行を追加 ---
    newRow = ws案件管理.Cells(ws案件管理.Rows.Count, "A").End(xlUp).Row + 1
    If newRow < 5 Then newRow = 5

    ws案件管理.Cells(newRow, 1).Value = nextID
    ws案件管理.Cells(newRow, 2).Value = 顧客ID
    ws案件管理.Cells(newRow, 3).Value = 顧客名
    ws案件管理.Cells(newRow, 4).Value = 物件名
    ws案件管理.Cells(newRow, 9).Value = "①リード"
    ws案件管理.Cells(newRow, 13).Value = 担当者
    ws案件管理.Cells(newRow, 19).Value = Date
    ws案件管理.Cells(newRow, 31).Value = 施工住所
    ws案件管理.Cells(newRow, 32).Value = 物件名

    escapedSheetName = EscapeSheetNameForFormula(newSheetName)
    ws案件管理.Cells(newRow, 6).Formula = "='" & escapedSheetName & "'!K50"
    ws案件管理.Cells(newRow, 7).Formula = "='" & escapedSheetName & "'!G50"
    ws案件管理.Cells(newRow, 8).Formula = "=IF(AND(F" & newRow & "<>"""",G" & newRow & "<>""""),(F" & newRow & "-G" & newRow & ")/F" & newRow & ","""")"
    ws案件管理.Cells(newRow, 30).Formula = "=IF(OR(I" & newRow & "=""⑤受注"",I" & newRow & "=""⑦完工""),""受注"",IF(I" & newRow & "=""⑥失注"",""失注"",IF(I" & newRow & "="""","""",""商談中"")))"

    '--- 5. S表紙を切り替え ---
    wsS表紙.Range("J2").Value = newSheetName
    wsS表紙.Range("J3").Value = nextID

    '--- 6. 新シートに遷移 ---
    ws新規.Activate
    ws新規.Range("B15").Select

    MsgBox "案件を作成しました！" & vbCrLf & vbCrLf & _
           "案件ID: " & nextID & vbCrLf & _
           "シート: " & newSheetName & vbCrLf & vbCrLf & _
           "見積項目の入力を開始してください。", _
           vbInformation, "新規案件作成 完了"

SafeExit:
    If templateWasHidden Then
        On Error Resume Next
        wsテンプレート.Visible = xlSheetHidden
        On Error GoTo 0
    End If
    Application.ScreenUpdating = oldScreenUpdating
    Exit Sub

ErrHandler:
    MsgBox "新規案件作成でエラーが発生しました。" & vbCrLf & _
           "内容: " & Err.Description, vbCritical, "新規案件作成エラー"
    Resume SafeExit
End Sub

'-------------------------------------------------------------
' S表紙PDF出力
'-------------------------------------------------------------
Public Sub S表紙PDF出力()
    Dim wsS表紙 As Worksheet
    Dim 案件名 As String
    Dim fileName As String
    Dim savePath As String

    On Error GoTo ErrHandler

    Set wsS表紙 = ThisWorkbook.Sheets("Ｓ表紙")

    案件名 = Trim$(CStr(wsS表紙.Range("J2").Value))
    If 案件名 = "" Then
        MsgBox "S表紙に案件が設定されていません。" & vbCrLf & _
               "操作パネルで案件を作成してください。", vbExclamation
        Exit Sub
    End If

    savePath = GetDesktopPath()
    fileName = "見積書_" & SanitizeFileName(案件名, "案件未設定") & "_" & Format$(Date, "yyyymmdd") & ".pdf"

    If MsgBox("以下のファイル名でPDFを保存します:" & vbCrLf & vbCrLf & _
              fileName & vbCrLf & vbCrLf & _
              "保存先: デスクトップ", vbYesNo + vbQuestion, "PDF出力") = vbNo Then
        Exit Sub
    End If

    wsS表紙.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox "PDFを保存しました:" & vbCrLf & fileName, vbInformation, "PDF出力完了"
    Exit Sub

ErrHandler:
    MsgBox "S表紙PDF出力でエラーが発生しました。" & vbCrLf & _
           "内容: " & Err.Description, vbCritical, "PDF出力エラー"
End Sub

'-------------------------------------------------------------
' 領収書PDF出力
'-------------------------------------------------------------
Public Sub 領収書PDF出力()
    Dim ws領収書 As Worksheet
    Dim 請求ID As String
    Dim fileName As String
    Dim savePath As String

    On Error GoTo ErrHandler

    Set ws領収書 = ThisWorkbook.Sheets("領収書")
    請求ID = Trim$(CStr(ws領収書.Range("J2").Value))

    If 請求ID = "" Then
        MsgBox "領収書のJ2に請求IDを入力してください。", vbExclamation
        ws領収書.Activate
        ws領収書.Range("J2").Select
        Exit Sub
    End If

    savePath = GetDesktopPath()
    fileName = "領収書_" & SanitizeFileName(請求ID, "請求ID未設定") & "_" & Format$(Date, "yyyymmdd") & ".pdf"

    ws領収書.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox "領収書PDFを保存しました:" & vbCrLf & fileName, vbInformation
    Exit Sub

ErrHandler:
    MsgBox "領収書PDF出力でエラーが発生しました。" & vbCrLf & _
           "内容: " & Err.Description, vbCritical, "PDF出力エラー"
End Sub

'-------------------------------------------------------------
' 発注書PDF出力
'-------------------------------------------------------------
Public Sub 発注書PDF出力()
    Dim ws発注書 As Worksheet
    Dim 案件ID As String
    Dim 業者ID As String
    Dim docType As String
    Dim fileName As String
    Dim savePath As String

    On Error GoTo ErrHandler

    Set ws発注書 = ThisWorkbook.Sheets("発注書兼請求書")
    savePath = GetDesktopPath()

    案件ID = Trim$(CStr(ws発注書.Range("D1").Value))
    業者ID = Trim$(CStr(ws発注書.Range("G1").Value))
    docType = Trim$(CStr(ws発注書.Range("B1").Value))
    If docType = "" Then docType = "発注書"

    fileName = SanitizeFileName(docType, "発注書") & "_" & _
               SanitizeFileName(案件ID, "案件ID未設定") & "_" & _
               SanitizeFileName(業者ID, "業者ID未設定") & "_" & _
               Format$(Date, "yyyymmdd") & ".pdf"

    ws発注書.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox docType & "PDFを保存しました:" & vbCrLf & fileName, vbInformation
    Exit Sub

ErrHandler:
    MsgBox "発注書PDF出力でエラーが発生しました。" & vbCrLf & _
           "内容: " & Err.Description, vbCritical, "PDF出力エラー"
End Sub

'-------------------------------------------------------------
' 操作パネルに主要ボタンを自動配置する
'-------------------------------------------------------------
Public Sub 操作パネルボタン配置()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("操作パネル")

    Application.ScreenUpdating = False
    On Error GoTo ErrHandler

    Call EnsurePanelButton(ws, "btn新規案件作成", "新規案件作成", "新規案件作成", 20, 130, 170, 26)
    Call EnsurePanelButton(ws, "btnS表紙PDF出力", "S表紙PDF出力", "S表紙PDF出力", 20, 162, 170, 26)
    Call EnsurePanelButton(ws, "btn領収書PDF出力", "領収書PDF出力", "領収書PDF出力", 20, 194, 170, 26)

    Application.ScreenUpdating = True
    MsgBox "操作パネルにボタンを配置しました。", vbInformation, "初期設定完了"
    Exit Sub

ErrHandler:
    Application.ScreenUpdating = True
    MsgBox "ボタン配置でエラーが発生しました。" & vbCrLf & _
           "内容: " & Err.Description, vbCritical, "初期設定エラー"
End Sub

'-------------------------------------------------------------
' 指定名のボタンを再作成してマクロを割り当てる
'-------------------------------------------------------------
Private Sub EnsurePanelButton(ByVal ws As Worksheet, _
                              ByVal buttonName As String, _
                              ByVal captionText As String, _
                              ByVal macroName As String, _
                              ByVal leftPos As Double, _
                              ByVal topPos As Double, _
                              ByVal buttonWidth As Double, _
                              ByVal buttonHeight As Double)
    Dim btn As Button

    On Error Resume Next
    ws.Buttons(buttonName).Delete
    On Error GoTo 0

    Set btn = ws.Buttons.Add(leftPos, topPos, buttonWidth, buttonHeight)
    btn.Name = buttonName
    btn.Characters.Text = captionText
    btn.OnAction = macroName
End Sub
