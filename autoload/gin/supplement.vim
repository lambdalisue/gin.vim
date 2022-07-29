function! gin#supplement#init(winid, supplements) abort
  call s:init(a:winid, a:supplements)
endfunction

function! gin#supplement#open(winid) abort
  call s:open(a:winid)
endfunction

function! gin#supplement#close(winid) abort
  call s:close(a:winid)
endfunction

function! gin#supplement#update(winid, ...) abort
  call call('s:update', [a:winid] + a:000)
endfunction

function! s:init(winid, supplements) abort
  let bufnr = winbufnr(a:winid)
  let supplements = map(copy(a:supplements), { -> extend({'winid': 0}, v:val)})
  call setwinvar(a:winid, 'gin_supplement_supplements', supplements)

  augroup gin_supplement_init
    execute printf('autocmd! * <buffer=%d>', bufnr)
  augroup END
endfunction

function! s:open(winid) abort
  let supplements = getwinvar(a:winid, 'gin_supplement_supplements')
  if empty(supplements)
    return
  endif
  call s:close(a:winid)
  let winid_saved = win_getid()
  try
    call win_gotoid(a:winid)
    for supplement in supplements
      execute supplement.opener
      let supplement.winid = win_getid()
    endfor
    call gin#internal#core#attachement#attach_to(a:winid, {
         \ 'targets': map(copy(supplements), { -> v:val.winid }),
         \})
  finally
    call win_gotoid(winid_saved)
  endtry
endfunction

function! s:close(winid) abort
  let supplements = getwinvar(a:winid, 'gin_supplement_supplements')
  if empty(supplements)
    return
  endif
  for supplement in supplements
    if supplement.winid isnot# 0
      call win_execute(supplement.winid, 'quit')
    endif
    let supplement.winid = 0
  endfor
endfunction

function! s:update(winid, ...) abort
  let supplements = getwinvar(a:winid, 'gin_supplement_supplements')
  if empty(supplements)
    return
  endif
  for supplement in supplements
    let expr = call(supplement.command, a:000)
    call win_execute(supplement.winid, expr)
  endfor
endfunction

function! s:BufWinEnter() abort
  echomsg printf("BufWinEnter %d/%d - %s", bufnr(), win_getid(), reltimefloat(reltime()))
endfunction

function! s:BufWinLeave() abort
  echomsg printf("BufWinLeave %d/%d - %s", bufnr(), win_getid(), reltimefloat(reltime()))
endfunction

function! s:info() abort
  return printf(
        \ "%d/%d/%d %s",
        \ expand("<abuf>"),
        \ bufnr(),
        \ win_getid(),
        \ reltimefloat(reltime()),
        \)
endfunction

augroup gin_supplement_internal
  autocmd!
  autocmd BufWinEnter * echomsg printf("BufWinEnter %s", s:info())
  autocmd BufWinLeave * echomsg printf("BufWinLeave %s", s:info())
  autocmd BufEnter * echomsg printf("BufEnter %s", s:info())
  autocmd BufLeave * echomsg printf("BufLeave %s", s:info())
  autocmd WinEnter * echomsg printf("WinEnter %s", s:info())
  autocmd WinLeave * echomsg printf("WinLeave %s", s:info())
augroup END
