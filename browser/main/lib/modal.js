import React from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom'
import { store } from '../store'

class ModalBase extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      component: null,
      componentProps: {},
      isHidden: true
    }
    this.close = this.close.bind(this)
  }

  close() {
    this.setState({
      component: null,
      componentProps: null,
      isHidden: true
    })
    // Toggle overflow style on NoteList
    const list = document.querySelector(
      '.NoteList__list___browser-main-NoteList-'
    )
    list.style.overflow = 'auto'
  }

  render() {
    return (
      <div className={'ModalBase' + (this.state.isHidden ? ' hide' : '')}>
        <div onClick={e => this.close(e)} className='modalBack' />
        {this.state.component == null ? null : (
          <Provider store={store}>
            <this.state.component
              {...this.state.componentProps}
              close={this.close}
            />
          </Provider>
        )}
      </div>
    )
  }
}

const el = document.createElement('div')
document.body.appendChild(el)
const modalBaseRef = React.createRef()
ReactDOM.createRoot(el).render(<ModalBase ref={modalBaseRef} />)

export function openModal(component, props) {
  if (modalBaseRef.current == null) {
    return
  }
  // Hide scrollbar by removing overflow when modal opens
  const list = document.querySelector(
    '.NoteList__list___browser-main-NoteList-'
  )
  list.style.overflow = 'hidden'
  document.body.setAttribute('data-modal', 'open')
  modalBaseRef.current.setState({
    component: component,
    componentProps: props,
    isHidden: false
  })
}

export function closeModal() {
  if (modalBaseRef.current == null) {
    return
  }
  modalBaseRef.current.close()
}

export default {
  open: openModal,
  close: closeModal
}
