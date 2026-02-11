'=============================================================
' 見積原価管理システム - VBAマクロ
' Module: 新規案件作成
' 株式会社LinK
'=============================================================

Option Explicit

'-------------------------------------------------------------
' 新規案件作成メイン処理
' 操作パネルの「新規案件作成」ボタンから呼び出す
'-------------------------------------------------------------
Sub 新規案件作成()

    Dim ws案件管理 As Worksheet
    Dim wsテンプレート As Worksheet
    Dim wsマスター As Worksheet
    Dim ws操作パネル As Worksheet
    Dim ws新規 As Worksheet

    Set ws案件管理 = ThisWorkbook.Sheets("案件管理")
    Set wsテンプレート = ThisWorkbook.Sheets("案件テンプレート")
    Set wsマスター = ThisWorkbook.Sheets("マスター設定")
    Set ws操作パネル = ThisWorkbook.Sheets("操作パネル")

    '--- 1. 次の案件IDを自動採番 ---
    Dim nextID As String
    Dim lastRow As Long
    Dim maxNum As Long
    maxNum = 0

    ' 案件管理のA列からP-XXXの最大番号を取得
    lastRow = ws案件管理.Cells(ws案件管理.Rows.Count, "A").End(xlUp).Row
    Dim i As Long
    For i = 5 To lastRow
        Dim cellVal As String
        cellVal = CStr(ws案件管理.Cells(i, 1).Value)
        If Left(cellVal, 2) = "P-" Then
            Dim num As Long
            num = CLng(Mid(cellVal, 3))
            If num > maxNum Then maxNum = num
        End If
    Next i

    nextID = "P-" & Format(maxNum + 1, "000")

    '--- 2. 入力フォーム（InputBoxで簡易実装） ---
    ' 顧客ID
    Dim 顧客ID As String
    顧客ID = ws操作パネル.Range("B7").Value
    If 顧客ID = "" Then
        MsgBox "操作パネルのB7に顧客IDを選択してください。", vbExclamation
        ws操作パネル.Activate
        ws操作パネル.Range("B7").Select
        Exit Sub
    End If

    ' 顧客名を自動取得
    Dim 顧客名 As String
    顧客名 = CStr(ws操作パネル.Range("D7").Value)

    ' 物件名
    Dim 物件名 As String
    物件名 = InputBox("物件名を入力してください:" & vbCrLf & _
                       "（例: 吉野様邸 キッチンリフォーム）" & vbCrLf & vbCrLf & _
                       "顧客: " & 顧客名 & "（" & 顧客ID & "）" & vbCrLf & _
                       "案件ID: " & nextID, _
                       "新規案件作成 - Step 1/3")
    If 物件名 = "" Then Exit Sub

    ' 施工住所
    Dim 施工住所 As String
    施工住所 = InputBox("施工住所を入力してください:" & vbCrLf & _
                         "（例: 東京都江戸川区北葛西1-2-22）", _
                         "新規案件作成 - Step 2/3")
    ' 住所は空でもOK

    ' 担当者
    Dim 担当者 As String
    担当者 = ws操作パネル.Range("B9").Value
    If 担当者 = "" Then 担当者 = "吉野博"

    ' 目標粗利率
    Dim 目標粗利率 As Double
    目標粗利率 = ws操作パネル.Range("D9").Value
    If 目標粗利率 = 0 Then 目標粗利率 = 0.25

    '--- 3. 確認ダイアログ ---
    Dim confirmMsg As String
    confirmMsg = "以下の内容で案件を作成します:" & vbCrLf & vbCrLf & _
                 "案件ID: " & nextID & vbCrLf & _
                 "顧客: " & 顧客名 & "（" & 顧客ID & "）" & vbCrLf & _
                 "物件名: " & 物件名 & vbCrLf & _
                 "施工住所: " & IIf(施工住所 = "", "（未入力）", 施工住所) & vbCrLf & _
                 "担当者: " & 担当者 & vbCrLf & _
                 "目標粗利率: " & Format(目標粗利率, "0%") & vbCrLf & vbCrLf & _
                 "よろしいですか？"

    If MsgBox(confirmMsg, vbYesNo + vbQuestion, "新規案件作成 - Step 3/3") = vbNo Then
        Exit Sub
    End If

    '--- 4. 案件テンプレートをコピー ---
    Application.ScreenUpdating = False

    Dim newSheetName As String
    newSheetName = nextID & "_" & 物件名
    ' シート名は31文字制限
    If Len(newSheetName) > 31 Then
        newSheetName = Left(newSheetName, 31)
    End If

    ' 既に同名シートがあるかチェック
    Dim ws As Worksheet
    For Each ws In ThisWorkbook.Worksheets
        If ws.Name = newSheetName Then
            MsgBox "同名のシートが既に存在します: " & newSheetName, vbExclamation
            Application.ScreenUpdating = True
            Exit Sub
        End If
    Next ws

    ' テンプレートをコピー（案件テンプレートの後に配置）
    wsテンプレート.Copy After:=wsテンプレート
    Set ws新規 = ActiveSheet
    ws新規.Name = newSheetName

    ' 新規シートにヘッダー情報をセット
    ws新規.Range("B3").Value = nextID          ' 案件ID
    ws新規.Range("B4").Value = 物件名          ' 案件名/工事名
    ws新規.Range("B5").Value = 顧客名          ' 顧客名
    ws新規.Range("B7").Value = 目標粗利率      ' 目標粗利率

    '--- 5. 案件管理に新行を追加 ---
    Dim newRow As Long
    ' 空の行を探す（P-004以降の空行を使う）
    For i = 5 To 104
        If ws案件管理.Cells(i, 1).Value = nextID Or _
           (ws案件管理.Cells(i, 1).Value = "" And ws案件管理.Cells(i, 4).Value = "") Then
            newRow = i
            Exit For
        End If
    Next i

    ' 既にP-XXXが予約されている行を使うか、新規行
    If newRow = 0 Then newRow = lastRow + 1

    ws案件管理.Cells(newRow, 1).Value = nextID            ' A: 案件ID
    ws案件管理.Cells(newRow, 2).Value = 顧客ID            ' B: 顧客ID
    ws案件管理.Cells(newRow, 3).Value = 顧客名            ' C: 顧客名
    ws案件管理.Cells(newRow, 4).Value = 物件名            ' D: 案件名
    ws案件管理.Cells(newRow, 9).Value = "①リード"         ' I: ステータス
    ws案件管理.Cells(newRow, 13).Value = 担当者            ' M: 担当者
    ws案件管理.Cells(newRow, 19).Value = Date              ' S: 作成日
    ws案件管理.Cells(newRow, 31).Value = 施工住所          ' AE: 施工住所
    ws案件管理.Cells(newRow, 32).Value = 物件名            ' AF: 物件名

    ' 見積金額・実行予算を新シートから参照する数式をセット
    ws案件管理.Cells(newRow, 6).Formula = "='" & newSheetName & "'!K50"   ' F: 見積金額
    ws案件管理.Cells(newRow, 7).Formula = "='" & newSheetName & "'!G50"   ' G: 実行予算
    ' 粗利率（H列）
    ws案件管理.Cells(newRow, 8).Formula = "=IF(AND(F" & newRow & "<>"""",G" & newRow & "<>""""),(F" & newRow & "-G" & newRow & ")/F" & newRow & ","""")"

    '--- 6. S表紙のJ2を更新 ---
    Dim wsS表紙 As Worksheet
    Set wsS表紙 = ThisWorkbook.Sheets("Ｓ表紙")
    wsS表紙.Range("J2").Value = newSheetName
    wsS表紙.Range("J3").Value = nextID

    ' S表紙のI36:I55を新シートの参照に書き換え
    Dim r As Long
    For r = 36 To 55
        Dim cellRef As String
        cellRef = "B" & (r + 69) ' B105〜B124に対応
        wsS表紙.Cells(r, 9).Formula = "='" & newSheetName & "'!" & cellRef
    Next r

    Application.ScreenUpdating = True

    '--- 7. 新シートに遷移 ---
    ws新規.Activate
    ws新規.Range("B15").Select  ' 最初の入力行にカーソル

    '--- 8. 完了メッセージ ---
    MsgBox "案件を作成しました！" & vbCrLf & vbCrLf & _
           "案件ID: " & nextID & vbCrLf & _
           "シート: " & newSheetName & vbCrLf & vbCrLf & _
           "見積項目の入力を開始してください。", _
           vbInformation, "新規案件作成 完了"

End Sub

'-------------------------------------------------------------
' S表紙PDF出力
' S表紙を案件名付きでPDFとして保存
'-------------------------------------------------------------
Sub S表紙PDF出力()

    Dim wsS表紙 As Worksheet
    Set wsS表紙 = ThisWorkbook.Sheets("Ｓ表紙")

    Dim 案件名 As String
    案件名 = wsS表紙.Range("J2").Value

    If 案件名 = "" Then
        MsgBox "S表紙に案件が設定されていません。", vbExclamation
        Exit Sub
    End If

    ' 保存先をデスクトップに設定
    Dim savePath As String
    savePath = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\"

    Dim fileName As String
    fileName = "見積書_" & 案件名 & "_" & Format(Date, "yyyymmdd") & ".pdf"

    ' 確認
    If MsgBox("以下のファイル名でPDFを保存します:" & vbCrLf & vbCrLf & _
              fileName & vbCrLf & vbCrLf & _
              "保存先: デスクトップ", _
              vbYesNo + vbQuestion, "PDF出力") = vbNo Then
        Exit Sub
    End If

    ' PDF出力
    wsS表紙.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox "PDFを保存しました:" & vbCrLf & fileName, vbInformation, "PDF出力完了"

End Sub

'-------------------------------------------------------------
' 領収書PDF出力
'-------------------------------------------------------------
Sub 領収書PDF出力()

    Dim ws領収書 As Worksheet
    Set ws領収書 = ThisWorkbook.Sheets("領収書")

    Dim 請求ID As String
    請求ID = ws領収書.Range("J2").Value

    If 請求ID = "" Then
        MsgBox "領収書のJ2に請求IDを入力してください。", vbExclamation
        ws領収書.Activate
        ws領収書.Range("J2").Select
        Exit Sub
    End If

    Dim savePath As String
    savePath = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\"

    Dim fileName As String
    fileName = "領収書_" & 請求ID & "_" & Format(Date, "yyyymmdd") & ".pdf"

    ws領収書.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox "領収書PDFを保存しました:" & vbCrLf & fileName, vbInformation

End Sub

'-------------------------------------------------------------
' 発注書PDF出力
'-------------------------------------------------------------
Sub 発注書PDF出力()

    Dim ws発注書 As Worksheet
    Set ws発注書 = ThisWorkbook.Sheets("発注書兼請求書")

    Dim savePath As String
    savePath = CreateObject("WScript.Shell").SpecialFolders("Desktop") & "\"

    Dim 案件ID As String
    案件ID = ws発注書.Range("D1").Value

    Dim 業者ID As String
    業者ID = ws発注書.Range("G1").Value

    Dim docType As String
    docType = ws発注書.Range("B1").Value ' 発注書 or 請求書

    Dim fileName As String
    fileName = docType & "_" & 案件ID & "_" & 業者ID & "_" & Format(Date, "yyyymmdd") & ".pdf"

    ws発注書.ExportAsFixedFormat _
        Type:=xlTypePDF, _
        fileName:=savePath & fileName, _
        Quality:=xlQualityStandard, _
        IncludeDocProperties:=True, _
        IgnorePrintAreas:=False

    MsgBox docType & "PDFを保存しました:" & vbCrLf & fileName, vbInformation

End Sub
