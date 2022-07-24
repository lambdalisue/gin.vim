function! gin#window#supplement#init() abort
  if exists('b:gin_window_supplement')
    return
  endif
  let b:gin_window_supplement = {}
  augroup gin_window_supplement_init_internal
    autocmd! * <buffer>
    autocmd WinClosed <buffer> call s:WinClosed()
    autocmd TabEnter <buffer> call s:TabEnter()
  augroup END
  call s:TabEnter()
endfunction

function! gin#window#supplement#ctx(...) abort
  let winid = a:0 ? a:1 : win_getid()
  let bufnr = winbufnr(winid)
  let tabnr = win_id2tabwin(winid)[0]
  let store = getbufvar(bufnr, 'gin_window_supplement', {})
  let ctx = get(store, tabnr, v:null)
  return ctx
endfunction

function! gin#window#supplement#add(ctx, name, ...) abort
  let winid = a:0 ? a:1 : win_getid()
  let a:ctx.supplements[a:name] = winid
endfunction

function! gin#window#supplement#close_all(ctx) abort
  for winid in values(a:ctx.supplements)
    silent! call win_execute(winid, 'quit')
  endfor
  let a:ctx.supplements = {}
endfunction

function! s:TabEnter() abort
  " if exists('t:loaded_gin_window_supplement')
  "   return
  " endif
  " let t:loaded_gin_window_supplement = 1

  let tabnr = tabpagenr()
  let store = b:gin_window_supplement
  let store[tabnr] = get(store, tabnr, {
        \ 'bufnr': bufnr(),
        \ 'winid': win_getid(),
        \ 'supplements': {},
        \})
endfunction

function! s:WinClosed() abort
  let winid = str2nr(expand('<amatch>'))
  let bufnr = winbufnr(winid)
  let tabnr = win_id2tabwin(winid)[0]
  let store = getbufvar(bufnr, 'gin_window_supplement', {})
  let ctx = get(store, tabnr, {})
  if get(ctx, 'winid') isnot# winid
    return
  endif
  call timer_start(0, { -> gin#window#supplement#close_all(ctx) })
endfunction

function! s:BufLeave() abort
  let bufnr = expand('<abuf>') + 0
  let tabnr = tabpagenr()
  let store = getbufvar(bufnr, 'gin_window_supplement', {})
  let ctx = get(store, tabnr, v:null)
  let t:gin_window_supplement_ctx = ctx
endfunction

function! s:BufEnter() abort
  let ctx = get(t:, 'gin_window_supplement_ctx', v:null)
  if ctx is# v:null
    return
  endif
  if winbufnr(ctx.winid) isnot# ctx.bufnr
    call gin#window#supplement#close_all(ctx)
  endif
endfunction

augroup gin_window_supplement_internal
  autocmd!
  autocmd BufLeave * call s:BufLeave()
  autocmd BufEnter * call s:BufEnter()
augroup END
